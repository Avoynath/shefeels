"""
Analytics endpoints for admin dashboard.
"""
from fastapi import APIRouter, Depends
from app.api.v1.deps import require_admin

router = APIRouter()

@router.get("/overview")
def analytics_overview(admin=Depends(require_admin)):
    """Get key metrics for admin dashboard."""
    # TODO: Implement analytics aggregation
    raise NotImplementedError
