// Every dependent write in the same D1 batch must carry this predicate.
// A stale update cannot borrow a successful request's token.
export const ownsOrderMutation = 'EXISTS (SELECT 1 FROM orders WHERE id=? AND mutation_token=?)';
