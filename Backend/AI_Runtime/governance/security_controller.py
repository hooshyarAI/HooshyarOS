class SecurityController:

    def protect(self, data):

        return {
            "data": data,
            "status": "secured"
        }
