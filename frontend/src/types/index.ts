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
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};


export type OrderStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "ready_for_fulfillment"
  | "completed"
  | "cancelled";

export type Order = {
  id: string;
  buyer_id: string;
  farmer_id: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  total_price: number | string;
  delivery_address: string;
  buyer_note: string | null;
  rejection_reason: string | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};
