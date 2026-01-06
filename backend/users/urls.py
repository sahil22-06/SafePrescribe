from django.urls import path
from .views import UserRegistrationView, UserLoginView, get_user_profile, update_user_profile, get_doctors

urlpatterns = [
    path('auth/register/', UserRegistrationView.as_view(), name='register'),
    path('auth/login/', UserLoginView.as_view(), name='login'),
    path('auth/profile/', get_user_profile, name='profile'),
    path('auth/profile/update/', update_user_profile, name='update_profile'),
    path('auth/doctors/', get_doctors, name='get_doctors'),
] 