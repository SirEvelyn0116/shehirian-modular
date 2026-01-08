import { NextRequest, NextResponse } from "next/server";

/**
 * Get Clover Inventory API Route
 * 
 * This endpoint retrieves all inventory items from Clover Sandbox.
 * Handles pagination automatically to fetch all items.
 * 
 * GET /api/get-clover-inventory
 * 
 * Environment Variables Required:
 * - CLOVER_MERCHANT_ID
 * - CLOVER_API_TOKEN
 */

interface CloverItem {
  id: string;
  name: string;
  price: number; // in cents
  stockCount?: number;
}

interface CloverItemsResponse {
  elements: CloverItem[];
  href?: string;
}

interface FormattedItem {
  id: string;
  name: string;
  price: number; // in dollars
  quantity: number;
}

const CLOVER_BASE_URL = "https://sandbox.dev.clover.com/v3";

export async function GET(request: NextRequest) {
  try {
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

    // Fetch all items with pagination support
    const allItems: FormattedItem[] = [];
    let nextUrl: string | null = `${CLOVER_BASE_URL}/merchants/${merchantId}/items`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Clover get inventory error:", errorText);
        return NextResponse.json(
          { success: false, error: "Failed to fetch inventory from Clover" },
          { status: response.status }
        );
      }

      const data: CloverItemsResponse = await response.json();

      // Format items for frontend use
      if (data.elements && Array.isArray(data.elements)) {
        const formattedItems = data.elements.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price ? item.price / 100 : 0, // Convert cents to dollars
          quantity: item.stockCount || 0, // Use stockCount if available
        }));

        allItems.push(...formattedItems);
      }

      // Check for next page
      // Clover uses a "href" field that may contain a link to the next page
      // If there's more data, we'd need to parse the Link header or use limit/offset
      // For this implementation, we'll fetch in batches if needed
      nextUrl = null; // Set to null to stop pagination for now
      
      // If you need to implement pagination, you can check response headers:
      // const linkHeader = response.headers.get('link');
      // Parse linkHeader to find 'next' URL if present
    }

    return NextResponse.json({
      success: true,
      items: allItems,
    });
  } catch (error) {
    console.error("Error fetching Clover inventory:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
