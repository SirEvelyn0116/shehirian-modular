import { NextRequest, NextResponse } from "next/server";

// In-memory store for demo purposes
// This would normally query a database
const orders = new Map<string, any>();

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;

  // In production, fetch from database
  const order = orders.get(orderId);

  if (!order) {
    // Return mock data if order not found (for demo purposes)
    return NextResponse.json({
      orderId,
      trackingNumber: `DEMO-${Math.random().toString(36).substr(2, 12).toUpperCase()}`,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      ),
    });
  }

  return NextResponse.json(order);
}
