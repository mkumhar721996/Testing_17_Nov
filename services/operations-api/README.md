# operations-api

## Authentication

Dashboard routes (`/dashboard/*`) require `Authorization: Bearer <Cognito token>`.
Configure verification with:

- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`

If either is unset every protected route returns 401 (fail closed). `/health` is unguarded.

The dashboard serves static sample data for a single investor; a real source is out of scope.
