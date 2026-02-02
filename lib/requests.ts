'use server'

export async function getEthereumPrice(): Promise<number> {
  const response = await fetch(
    "https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD",
    {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch ETH price: ${response.status}`);
  }

  const data: { USD?: number } = await response.json();

  if (typeof data.USD !== "number") {
    throw new Error("Invalid response from CryptoCompare");
  }

  return data.USD;
}
