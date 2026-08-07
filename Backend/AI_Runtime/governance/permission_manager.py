class PermissionManager:

    def check(self, user, permission):

        return {
            "user": user,
            "permission": permission,
            "allowed": True
        }
