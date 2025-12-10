export function generateRandomId(length = 8) {
   const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
   let result = "";
   for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return result;
}

const BASE_64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function isBase64Array(arr: any[]): arr is string[] {
   return arr.every(v => typeof v === "string" && BASE_64.test(v));
};
