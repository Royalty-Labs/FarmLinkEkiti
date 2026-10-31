from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    category: str = Field(min_length=2, max_length=80)
    price_per_unit: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    unit: str = Field(min_length=1, max_length=30)
    quantity_available: Decimal = Field(
        ge=0, max_digits=12, decimal_places=2
    )

    @field_validator("name", "category", "unit")
    @classmethod
    def clean_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    category: str | None = Field(default=None, min_length=2, max_length=80)
    price_per_unit: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    quantity_available: Decimal | None = Field(
        default=None, ge=0, max_digits=12, decimal_places=2
    )
    is_available: bool | None = None

    @field_validator("name", "category", "unit")
    @classmethod
    def clean_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update.")

        required_fields = (
            "name",
            "category",
            "price_per_unit",
            "unit",
            "quantity_available",
            "is_available",
        )
        for field in required_fields:
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field.replace('_', ' ').capitalize()} cannot be null.")

        return self


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    seller_id: UUID
    name: str
    description: str | None
    category: str
    price_per_unit: Decimal
    unit: str
    quantity_available: Decimal
    location: str
    is_available: bool
    created_at: datetime
    updated_at: datetime
