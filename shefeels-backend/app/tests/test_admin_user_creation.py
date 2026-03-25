"""
Test for Admin User Creation functionality.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, AsyncMock
from app.main import app
from app.models.user import User, RoleEnum
from app.schemas.user import AdminUserCreateRequest

client = TestClient(app)

# Mock data
ADMIN_TOKEN = "mock-admin-token"
TEST_USER_DATA = {
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "password": "testpassword123",
    "role": "user"
}

@pytest.fixture
def mock_admin_user():
    """Mock admin user for authentication."""
    admin_user = Mock(spec=User)
    admin_user.id = 1
    admin_user.email = "admin@example.com"
    admin_user.role = RoleEnum.ADMIN
    admin_user.is_active = True
    return admin_user

@pytest.fixture
def mock_created_user():
    """Mock created user."""
    user = Mock(spec=User)
    user.id = 2
    user.email = TEST_USER_DATA["email"]
    user.full_name = TEST_USER_DATA["full_name"]
    user.role = RoleEnum.USER
    user.is_active = True
    user.is_email_verified = True
    user.created_at = "2024-01-01T00:00:00"
    user.updated_at = "2024-01-01T00:00:00"
    return user

@patch('app.api.v1.deps.AuthService.get_user_from_token')
@patch('app.services.email.send_email')
@patch('app.services.admin.get_config_value_from_cache')
@patch('app.core.database.get_db')
class TestAdminUserCreation:
    
    async def test_create_user_success(
        self, 
        mock_get_db, 
        mock_get_config, 
        mock_send_email, 
        mock_get_user_from_token,
        mock_admin_user,
        mock_created_user
    ):
        """Test successful user creation by admin."""
        # Mock dependencies
        mock_get_user_from_token.return_value = mock_admin_user
        mock_get_config.return_value = "http://localhost:3000"
        mock_send_email.return_value = AsyncMock()
        
        # Mock database session
        mock_db = AsyncMock()
        mock_get_db.return_value = mock_db
        
        # Mock database operations
        mock_db.execute.return_value.scalar_one_or_none.return_value = None  # No existing user
        mock_db.add = Mock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        
        # Configure the mock to return our created user after refresh
        def mock_refresh(user):
            for attr, value in vars(mock_created_user).items():
                if not attr.startswith('_'):
                    setattr(user, attr, value)
        mock_db.refresh.side_effect = mock_refresh
        
        # Make the request
        headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
        response = client.post(
            "/api/v1/admin/users/create",
            json=TEST_USER_DATA,
            headers=headers
        )
        
        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == TEST_USER_DATA["email"]
        assert data["full_name"] == TEST_USER_DATA["full_name"]
        assert data["is_email_verified"] is True
        
        # Verify email was sent
        mock_send_email.assert_called_once()
        email_args = mock_send_email.call_args
        assert "Welcome to AI Chat" in email_args.kwargs["subject"]
        assert TEST_USER_DATA["email"] in email_args.kwargs["to"]

    async def test_create_user_duplicate_email(
        self,
        mock_get_db,
        mock_get_config,
        mock_send_email,
        mock_get_user_from_token,
        mock_admin_user
    ):
        """Test user creation with duplicate email."""
        # Mock dependencies
        mock_get_user_from_token.return_value = mock_admin_user
        
        # Mock existing user in database
        existing_user = Mock()
        existing_user.email = TEST_USER_DATA["email"]
        
        mock_db = AsyncMock()
        mock_get_db.return_value = mock_db
        mock_db.execute.return_value.scalar_one_or_none.return_value = existing_user
        
        # Make the request
        headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
        response = client.post(
            "/api/v1/admin/users/create",
            json=TEST_USER_DATA,
            headers=headers
        )
        
        # Assertions
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

    async def test_create_user_unauthorized(
        self,
        mock_get_db,
        mock_get_config,
        mock_send_email,
        mock_get_user_from_token
    ):
        """Test user creation without admin privileges."""
        # Mock non-admin user
        regular_user = Mock(spec=User)
        regular_user.role = RoleEnum.USER
        mock_get_user_from_token.return_value = regular_user
        
        # Make the request
        headers = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
        response = client.post(
            "/api/v1/admin/users/create",
            json=TEST_USER_DATA,
            headers=headers
        )
        
        # Should be forbidden
        assert response.status_code == 403

def test_admin_user_create_request_schema():
    """Test the AdminUserCreateRequest schema validation."""
    # Valid data
    valid_data = TEST_USER_DATA.copy()
    request = AdminUserCreateRequest(**valid_data)
    assert request.email == valid_data["email"]
    assert request.full_name == valid_data["full_name"]
    assert request.role == RoleEnum.USER
    
    # Test invalid email
    invalid_email_data = valid_data.copy()
    invalid_email_data["email"] = "invalid-email"
    
    with pytest.raises(ValueError):
        AdminUserCreateRequest(**invalid_email_data)
    
    # Test short password
    short_password_data = valid_data.copy()
    short_password_data["password"] = "short"
    
    with pytest.raises(ValueError):
        AdminUserCreateRequest(**short_password_data)