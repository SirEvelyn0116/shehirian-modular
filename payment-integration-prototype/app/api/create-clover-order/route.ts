import { NextRequest, NextResponse } from "next/server";

/**
 * Create Clover Order API Route
 * 
 * This endpoint creates an order in Clover Sandbox and adds line items to it.
 * 
 * POST /api/create-clover-order
 * Body: { lineItems: Array<{name: string, price: number, quantity: number}>, total: number }
 * 
 * Environment Variables Required:
 * - CLOVER_MERCHANT_ID
 * - CLOVER_API_TOKEN
 */

interface LineItem {
  name: string;
  price: number;
  quantity: number;
}

interface CreateOrderRequest {
  lineItems: LineItem[];
  total: number;
}

interface CloverLineItem {
  name: string;
  price: number; // in cents
}

const CLOVER_BASE_URL = "https://sandbox.dev.clover.com/v3";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: CreateOrderRequest = await request.json();
    const { lineItems, total } = body;

    // Validate input
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing lineItems" },
        { status: 400 }
      );
    }

    if (typeof total !== "number" || total <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing total" },
        { status: 400 }
      );
    }

    // Get environment variables
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const apiToken = process.env.CLOVER_API_TOKEN;

    if (!merchantId || !apiToken) {
      console.error("Missing Clover credentials");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Step 1: Create the order
    const createOrderResponse = await fetch(
      `${CLOVER_BASE_URL}/merchants/${merchantId}/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: "open",
        }),
      }
    );

    if (!createOrderResponse.ok) {
      const errorText = await createOrderResponse.text();
      console.error("Clover create order error:", errorText);
      return NextResponse.json(
        { success: false, error: "Failed to create order in Clover" },
        { status: createOrderResponse.status }
      );
    }

    const orderData = await createOrderResponse.json();
    const orderId = orderData.id;

    // Step 2: Add line items to the order
    const lineItemPromises = lineItems.map(async (item) => {
      const lineItemPayload: CloverLineItem = {
        name: item.name,
        price: Math.round(item.price * 100), // Convert dollars to cents
      };

      const addLineItemResponse = await fetch(
        `${CLOVER_BASE_URL}/merchants/${merchantId}/orders/${orderId}/line_items`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
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

    // Return success response
    return NextResponse.json({
      success: true,
      orderId,
    });
  } catch (error) {
    console.error("Error creating Clover order:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
