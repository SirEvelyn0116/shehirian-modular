// Clover API Service
// This service handles communication with Clover's sandbox API

interface CloverOrder {
  id?: string;
  total: number;
  lineItems: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  fulfillmentType: string;
}

class CloverService {
  private apiKey: string;
  private merchantId: string;
  private deviceId: string;
  private baseUrl: string = "https://sandbox.dev.clover.com";

  constructor() {
    this.apiKey = process.env.CLOVER_API_TOKEN || "";
    this.merchantId = process.env.CLOVER_MERCHANT_ID || "";
    this.deviceId = process.env.CLOVER_DEVICE_ID || "";
  }

  /**
   * Create an order in Clover POS
   */
  async createOrder(orderData: CloverOrder): Promise<{ success: boolean; orderId?: string; error?: string }> {
    // Check if credentials are configured
    if (!this.apiKey || !this.merchantId) {
      console.warn("Clover API credentials not configured. Using mock mode.");
      return {
        success: true,
        orderId: `MOCK-CLV-${Date.now()}`,
      };
    }

    try {
      // Step 1: Create the order
      const createOrderResponse = await fetch(
        `${this.baseUrl}/v3/merchants/${this.merchantId}/orders`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: "open",
          }),
        }
      );

      if (!createOrderResponse.ok) {
        const errorText = await createOrderResponse.text();
        throw new Error(`Clover API error: ${errorText}`);
      }

      const orderResponse = await createOrderResponse.json();
      const orderId = orderResponse.id;

      // Step 2: Add line items to the order
      const lineItemPromises = orderData.lineItems.map(async (item) => {
        const lineItemPayload = {
          name: item.name,
          price: Math.round(item.price * 100), // Convert to cents
        };

        const addLineItemResponse = await fetch(
          `${this.baseUrl}/v3/merchants/${this.merchantId}/orders/${orderId}/line_items`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(lineItemPayload),
          }
        );

        if (!addLineItemResponse.ok) {
          const errorText = await addLineItemResponse.text();
          throw new Error(`Failed to add line item: ${errorText}`);
        }

        return addLineItemResponse.json();
      });

      // Wait for all line items to be added
      await Promise.all(lineItemPromises);

      console.log("Clover order created successfully:", orderId);
      return {
        success: true,
        orderId,
      };
    } catch (error) {
      console.error("Clover API error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Update inventory in Clover
   */
  async updateInventory(itemId: string, quantity: number): Promise<{ success: boolean }> {
    // Mock implementation
    // Real implementation would update item stock levels
    console.log(`Mock: Updating inventory for item ${itemId}, quantity: ${quantity}`);
    return { success: true };
  }

  /**
   * Get order details from Clover
   */
  async getOrder(orderId: string): Promise<CloverOrder | null> {
    // Mock implementation
    console.log(`Mock: Fetching Clover order ${orderId}`);
    return null;
  }
}

export const cloverService = new CloverService();
