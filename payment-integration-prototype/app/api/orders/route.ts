import { NextRequest, NextResponse } from "next/server";
import { cloverService } from "@/lib/clover";
import { shopifyShippingService } from "@/lib/shopify-shipping";
import { amazonFBAService } from "@/lib/amazon-fba";

// In-memory store for demo purposes
// In production, use a database
const orders = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quantity, itemPrice, fulfillmentOption, shippingRate, total } = body;

    // Generate order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order in Clover POS
    const cloverResult = await cloverService.createOrder({
      total,
      lineItems: [
        {
          name: "Sample Product",
          price: itemPrice,
          quantity,
        },
      ],
      fulfillmentType: fulfillmentOption === "amazon" ? "Amazon FBA" : "Shopify Shipping",
    });

    if (!cloverResult.success) {
      return NextResponse.json(
        { error: "Failed to sync with Clover POS" },
        { status: 500 }
      );
    }

    let trackingNumber = "";
    let estimatedDelivery = "";

    // Handle fulfillment based on option
    if (fulfillmentOption === "amazon") {
      // Create Amazon FBA fulfillment order
      const fbaResult = await amazonFBAService.createFulfillmentOrder(orderId, [
        { sku: "SAMPLE-PRODUCT-001", quantity },
      ]);
      trackingNumber = fbaResult.trackingNumber;
      estimatedDelivery = fbaResult.estimatedDelivery;
    } else {
      // Create Shopify shipment
      const shipmentResult = await shopifyShippingService.createShipment(
        orderId,
        shippingRate || ""
      );
      trackingNumber = shipmentResult.trackingNumber;
      estimatedDelivery = shipmentResult.estimatedDelivery;
    }

    // Store order details
    const orderData = {
      orderId,
      cloverOrderId: cloverResult.orderId,
      quantity,
      itemPrice,
      total,
      fulfillmentOption,
      shippingRate,
      trackingNumber,
      estimatedDelivery,
      createdAt: new Date().toISOString(),
    };

    orders.set(orderId, orderData);

    return NextResponse.json({
      success: true,
      orderId,
      trackingNumber,
      estimatedDelivery,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return all orders (for admin/debugging)
  return NextResponse.json({
    orders: Array.from(orders.values()),
  });
}
