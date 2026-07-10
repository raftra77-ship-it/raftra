with open('c:/Users/Ambn/raftra/backend/auth.py', 'a') as f:
    f.write('\n@router.get("/me", response_model=schemas.UserResponse)\ndef get_me(current_user: models.User = Depends(get_current_user)):\n    return current_user\n')
