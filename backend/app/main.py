from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.farmers import router as farmers_router
from app.api.routes.products import router as products_router
from app.api.routes.orders import router as orders_router


app = FastAPI(
    title="FarmLink Ekiti API",
    description="Agricultural marketplace for the Ado-Ekiti pilot.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(farmers_router)
app.include_router(products_router)
app.include_router(orders_router)
app.include_router(admin_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "message": "Welcome to FarmLink Ekiti API",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "farmlink-ekiti-api",
    }
