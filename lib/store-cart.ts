export const MAX_PRODUCT_QUANTITY = 50;

export function cartQuantity(requested: number, available: number) {
  return Math.max(0, Math.min(Math.floor(requested), Math.floor(available), MAX_PRODUCT_QUANTITY));
}

export function reconcileCart(
  cart: Record<number, number>, products: {id:number;available:number}[], loaded: boolean,
) {
  if (!loaded) return cart;
  const next: Record<number, number> = {};
  for (const [id, quantity] of Object.entries(cart)) {
    const product = products.find(item => item.id === Number(id));
    const count = cartQuantity(quantity, product?.available ?? 0);
    if (count > 0) next[Number(id)] = count;
  }
  return next;
}
