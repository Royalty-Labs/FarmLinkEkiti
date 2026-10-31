from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models import FarmerProfile, Product, User
from app.schemas.product import ProductCreate, ProductResponse, ProductUpdate


router = APIRouter(prefix="/products", tags=["Products"])


def get_approved_farmer_profile(
    current_user: User,
    db: Session,
) -> FarmerProfile:
    profile = db.scalar(
        select(FarmerProfile).where(
            FarmerProfile.user_id == current_user.id
        )
    )

    if profile is None or profile.verification_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An approved farmer profile is required to publish products.",
        )

    return profile


def get_owned_product(
    product_id: UUID,
    current_user: User,
    db: Session,
) -> Product:
    product = db.get(Product, product_id)

    if product is None or product.seller_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return product


@router.get("/mine", response_model=list[ProductResponse])
def list_my_products(
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> list[Product]:
    query = (
        select(Product)
        .where(Product.seller_id == current_user.id)
        .order_by(Product.created_at.desc(), Product.id.asc())
    )
    return list(db.scalars(query).all())


@router.get("", response_model=list[ProductResponse])
def list_public_products(
    category: str | None = Query(default=None, min_length=1, max_length=80),
    search: str | None = Query(default=None, min_length=1, max_length=150),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[Product]:
    query = (
        select(Product)
        .join(FarmerProfile, FarmerProfile.user_id == Product.seller_id)
        .where(
            FarmerProfile.verification_status == "approved",
            Product.is_available.is_(True),
            Product.quantity_available > Decimal("0"),
        )
    )

    if category is not None:
        query = query.where(Product.category.ilike(category.strip()))

    if search is not None:
        query = query.where(Product.name.ilike(f"%{search.strip()}%"))

    query = query.order_by(Product.created_at.desc(), Product.id.asc())
    query = query.offset(skip).limit(limit)

    return list(db.scalars(query).all())


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    data: ProductCreate,
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> Product:
    profile = get_approved_farmer_profile(current_user, db)

    product = Product(
        seller_id=current_user.id,
        name=data.name,
        description=data.description,
        category=data.category,
        price_per_unit=data.price_per_unit,
        unit=data.unit,
        quantity_available=data.quantity_available,
        location=f"{profile.town}, {profile.state}",
        is_available=True,
    )
    db.add(product)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The product could not be created.",
        ) from None

    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_public_product(
    product_id: UUID,
    db: Session = Depends(get_db),
) -> Product:
    query = (
        select(Product)
        .join(FarmerProfile, FarmerProfile.user_id == Product.seller_id)
        .where(
            Product.id == product_id,
            FarmerProfile.verification_status == "approved",
            Product.is_available.is_(True),
            Product.quantity_available > Decimal("0"),
        )
    )
    product = db.scalar(query)

    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )

    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    data: ProductUpdate,
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> Product:
    get_approved_farmer_profile(current_user, db)
    product = get_owned_product(product_id, current_user, db)

    changes = data.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The product could not be updated.",
        ) from None

    return product


@router.delete(
    "/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_product(
    product_id: UUID,
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> Response:
    # Owners can remove their own listing even if their approval later changes.
    product = get_owned_product(product_id, current_user, db)
    db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
