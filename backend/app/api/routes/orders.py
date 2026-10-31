from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models import FarmerProfile, Order, Product, User
from app.schemas.order import (
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
)

router = APIRouter(prefix="/orders", tags=["Orders"])


def get_order_or_404(
    order_id: UUID,
    db: Session,
) -> Order:
    order = db.get(Order, order_id)

    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )

    return order


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(require_role("buyer")),
    db: Session = Depends(get_db),
) -> Order:
    # Only products belonging to approved farmers can be ordered.
    product = db.scalar(
        select(Product)
        .join(
            FarmerProfile,
            FarmerProfile.user_id == Product.seller_id,
        )
        .where(
            Product.id == data.product_id,
            Product.is_available.is_(True),
            Product.quantity_available > Decimal("0"),
            FarmerProfile.verification_status == "approved",
        )
    )

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Available product not found.",
        )

    if data.quantity > product.quantity_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The requested quantity exceeds available stock.",
        )

    total_price = (
        product.price_per_unit * data.quantity
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    order = Order(
        buyer_id=current_user.id,
        farmer_id=product.seller_id,
        product_id=product.id,
        product_name=product.name,
        unit=product.unit,
        quantity=data.quantity,
        unit_price=product.price_per_unit,
        total_price=total_price,
        delivery_address=data.delivery_address,
        buyer_note=data.buyer_note,
        status="pending",
    )

    try:
        # Atomically reserve stock. The condition protects against
        # two buyers ordering the same remaining stock simultaneously.
        stock_update = db.execute(
            update(Product)
            .where(
                Product.id == product.id,
                Product.is_available.is_(True),
                Product.quantity_available >= data.quantity,
            )
            .values(
                quantity_available=(
                    Product.quantity_available - data.quantity
                ),
                updated_at=func.now(),
            )
        )

        if stock_update.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Stock has changed. Refresh the listing and try again.",
            )

        db.add(order)
        db.commit()
        db.refresh(order)

    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The order could not be created. Please try again.",
        ) from None

    return order


@router.get(
    "/mine",
    response_model=list[OrderResponse],
)
def list_my_orders(
    current_user: User = Depends(require_role("buyer")),
    db: Session = Depends(get_db),
) -> list[Order]:
    query = (
        select(Order)
        .where(Order.buyer_id == current_user.id)
        .order_by(Order.created_at.desc(), Order.id.asc())
    )

    return list(db.scalars(query).all())


@router.get(
    "/farmer",
    response_model=list[OrderResponse],
)
def list_farmer_orders(
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> list[Order]:
    query = (
        select(Order)
        .where(Order.farmer_id == current_user.id)
        .order_by(Order.created_at.desc(), Order.id.asc())
    )

    return list(db.scalars(query).all())


@router.patch(
    "/{order_id}/status",
    response_model=OrderResponse,
)
def update_order_status(
    order_id: UUID,
    data: OrderStatusUpdate,
    current_user: User = Depends(require_role("buyer", "farmer")),
    db: Session = Depends(get_db),
) -> Order:
    order = get_order_or_404(order_id, db)

    # Define who may act and which transitions are allowed.
    if current_user.role == "buyer":
        if order.buyer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )

        allowed_transitions = {
            "pending": {"cancelled"},
            "ready_for_fulfillment": {"completed"},
        }

    else:
        if order.farmer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )

        allowed_transitions = {
            "pending": {"accepted", "rejected"},
            "accepted": {"ready_for_fulfillment"},
        }

    if data.status not in allowed_transitions.get(order.status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot change order status from "
                f"'{order.status}' to '{data.status}'."
            ),
        )

    previous_status = order.status

    try:
        # Only one request can successfully move an order from its
        # previous status. This prevents duplicate stock restoration.
        status_update = db.execute(
            update(Order)
            .where(
                Order.id == order.id,
                Order.status == previous_status,
            )
            .values(
                status=data.status,
                rejection_reason=(
                    data.rejection_reason
                    if data.status == "rejected"
                    else None
                ),
                updated_at=func.now(),
            )
            .execution_options(synchronize_session=False)
        )

        if status_update.rowcount != 1:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The order has changed. Refresh and try again.",
            )

        # Rejected or cancelled pending orders release reserved stock.
        if (
            previous_status == "pending"
            and data.status in {"rejected", "cancelled"}
            and order.product_id is not None
        ):
            db.execute(
                update(Product)
                .where(Product.id == order.product_id)
                .values(
                    quantity_available=(
                        Product.quantity_available + order.quantity
                    ),
                    updated_at=func.now(),
                )
            )

        db.commit()
        db.refresh(order)

    except HTTPException:
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The order status could not be updated.",
        ) from None

    return order
