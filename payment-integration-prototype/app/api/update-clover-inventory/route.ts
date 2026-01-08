import { NextRequest, NextResponse } from "next/server";

/**
 * Update Clover Inventory API Route
 * 
 * This endpoint updates inventory stock counts in Clover Sandbox
 * after items are purchased.
 * 
 * POST /api/update-clover-inventory
 * Body: { lineItems: Array<{ id: string, quantity: number }> }
 * 
 * Environment Variables Required:
 * - CLOVER_MERCHANT_ID
 * - CLOVER_API_TOKEN
 */

interface LineItem {
  id: string;
  quantity: number;
}

interface UpdateInventoryRequest {
  lineItems: LineItem[];
}

interface CloverItem {
  id: string;
  stockCount?: number;
}

const CLOVER_BASE_URL = "https://sandbox.dev.clover.com/v3";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: UpdateInventoryRequest = await request.json();
    const { lineItems } = body;

    // Validate input
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing lineItems" },
        { status: 400 }
      );
    }

    // Validate each line item
    for (const item of lineItems) {
      if (!item.id || typeof item.quantity !== "number" || item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: "Each line item must have a valid id and quantity" },
          { status: 400 }
        );
      }
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

    // Update inventory for each item
    const updatePromises = lineItems.map(async (item) => {
      // Step 1: Get current item data to retrieve current stock count
      const getItemResponse = await fetch(
        `${CLOVER_BASE_URL}/merchants/${merchantId}/items/${item.id}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!getItemResponse.ok) {
        const errorText = await getItemResponse.text();
        throw new Error(`Failed to get item ${item.id}: ${errorText}`);
      }

      const itemData: CloverItem = await getItemResponse.json();
      const currentStock = itemData.stockCount || 0;
      const newStock = Math.max(0, currentStock - item.quantity); // Prevent negative stock

      // Step 2: Update the item's stock count
      const updateItemResponse = await fetch(
        `${CLOVER_BASE_URL}/merchants/${merchantId}/items/${item.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stockCount: newStock, // Use whole numbers for stock count
          }),
        }
      );

      if (!updateItemResponse.ok) {
        const errorText = await updateItemResponse.text();
        throw new Error(`Failed to update item ${item.id}: ${errorText}`);
      }

      return {
        itemId: item.id,
        previousStock: currentStock,
        newStock,
        quantityPurchased: item.quantity,
      };
    });

    // Wait for all updates to complete
    const updateResults = await Promise.all(updatePromises);

    console.log("Inventory updated successfully:", updateResults);

    return NextResponse.json({
      success: true,
      updates: updateResults,
    });
  } catch (error) {
    console.error("Error updating Clover inventory:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
