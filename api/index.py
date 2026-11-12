from fastapi import FastAPI

app = FastAPI(
    title="SortSense API",
    description="Cloud API for SortSense Smart Waste Management System",
    version="1.0.0"
)

@app.get("/")
def root():
    return{
        "message": "Welcome to SortSense API",
        "status": "running"
    }

@app.get("/health")
def health_check():
    return{
        "status": "OK",
        "service": "SortSense API"
    }
