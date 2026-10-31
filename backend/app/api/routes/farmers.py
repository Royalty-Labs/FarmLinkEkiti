from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_role
from app.db.session import get_db
from app.models import FarmerProfile, User
from app.schemas.farmer import (
    FarmerProfileCreate,
    FarmerProfileResponse,
    FarmerProfileUpdate,
)


router = APIRouter(prefix="/farmers/me/profile", tags=["Farmer Profiles"])


@router.post(
    "",
    response_model=FarmerProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_farmer_profile(
    data: FarmerProfileCreate,
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> FarmerProfile:
    existing_profile = db.scalar(
        select(FarmerProfile).where(
            FarmerProfile.user_id == current_user.id
        )
    )

    if existing_profile is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a farmer profile. Use the update endpoint.",
        )

    profile = FarmerProfile(
        user_id=current_user.id,
        farm_name=data.farm_name,
        phone=data.phone,
        town=data.town,
        address=data.address,
        state="Ekiti State",
        verification_status="pending",
    )

    db.add(profile)

    try:
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A farmer profile already exists for this account.",
        ) from None

    return profile


@router.get("", response_model=FarmerProfileResponse)
def get_my_farmer_profile(
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> FarmerProfile:
    profile = db.scalar(
        select(FarmerProfile).where(
            FarmerProfile.user_id == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found. Create your profile first.",
        )

    return profile


@router.patch("", response_model=FarmerProfileResponse)
def update_my_farmer_profile(
    data: FarmerProfileUpdate,
    current_user: User = Depends(require_role("farmer")),
    db: Session = Depends(get_db),
) -> FarmerProfile:
    profile = db.scalar(
        select(FarmerProfile).where(
            FarmerProfile.user_id == current_user.id
        )
    )

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Farmer profile not found. Create your profile first.",
        )

    changes = data.model_dump(exclude_unset=True)

    for field, value in changes.items():
        setattr(profile, field, value)

    if profile.verification_status == "rejected":
        profile.verification_status = "pending"
        profile.rejection_reason = None

    try:
        db.commit()
        db.refresh(profile)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The farmer profile could not be updated.",
        ) from None

    return profile
