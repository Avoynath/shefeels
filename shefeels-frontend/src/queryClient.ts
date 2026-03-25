import { QueryClient } from '@tanstack/react-query';

// Shared QueryClient used by admin pages.
// Kept minimal and exported as default for easy import from admin/ code.
const queryClient = new QueryClient();

export default queryClient;
