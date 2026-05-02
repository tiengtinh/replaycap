I want to lock down exisiting features with extenstive unit testing
refactor the codebase to ensure clean separation of concerns
especially between business logics and side effects
so that all business logics can be tested and covered
effectively, this is ports and adapters (research extensively to make sure apply it correctly). This isolation allows writing unit tests the "inside" of the application (Domain/Application layers) without needing to spin up a database or network services.
effectively, this is DDD (research extensively to make sure apply it correctly)
