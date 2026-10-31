from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FarmerProfileReviewRequest(BaseModel):
    verification_status: Literal["approved", "rejected"]
    rejection_reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def validate_review(self):
        if self.verification_status == "rejected":
            if not self.rejection_reason or not self.rejection_reason.strip():
                raise ValueError(
                    "A rejection reason is required when rejecting a farmer."
                )
            self.rejection_reason = self.rejection_reason.strip()
        else:
            self.rejection_reason = None

        return self


class AdminFarmerUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: str


class AdminFarmerProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    user: AdminFarmerUserResponse
    farm_name: str
    phone: str
    state: str
    town: str
    address: str | None
    verification_status: Literal["pending", "approved", "rejected"]
    rejection_reason: str | None
    created_at: datetime
    updated_at: datetime
