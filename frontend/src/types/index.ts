export type User = {
  id: string;
  full_name: string;
  email: string;
  role: "buyer" | "farmer" | "admin" | string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
};

export type FarmerProfile = {
  id: string;
  user_id: string;
  farm_name: string;
  phone: string;
  state: string;
  town: string;
  address: string | null;
  verification_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  category: string;
  price_per_unit: number | string;
  unit: string;
  quantity_available: number | string;
  location: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};
