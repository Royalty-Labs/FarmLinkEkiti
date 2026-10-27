from fastapi import FastAPI

app = FastAPI(
    title="FarmLink Ekiti API",
    description="Agricultural marketplace for the Ado-Ekiti pilot.",
    version="0.1.0",
)


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
