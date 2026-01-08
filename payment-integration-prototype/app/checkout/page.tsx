"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type FulfillmentOption = "shopify" | "amazon";

interface ShippingRate {
  carrier: string;
  service: string;
  price: number;
  deliveryDays: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quantity = parseInt(searchParams.get("quantity") || "1");
  const itemPrice = 50.0;
  const subtotal = itemPrice * quantity;

  const [fulfillmentOption, setFulfillmentOption] =
    useState<FulfillmentOption>("shopify");
  const [selectedRate, setSelectedRate] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Mock shipping rates for Shopify
  const shopifyRates: ShippingRate[] = [
    {
      carrier: "Canada Post",
      service: "Expedited Parcel",
      price: 12.99,
      deliveryDays: "3-5",
    },
    {
      carrier: "Canada Post",
      service: "Regular Parcel",
      price: 8.99,
      deliveryDays: "5-7",
    },
    {
      carrier: "UPS",
      service: "Ground",
      price: 15.99,
      deliveryDays: "2-4",
    },
    {
      carrier: "UPS",
      service: "Express",
      price: 24.99,
      deliveryDays: "1-2",
    },
  ];

  // Set default rate when fulfillment option changes
  useEffect(() => {
    if (fulfillmentOption === "shopify") {
      setSelectedRate(`${shopifyRates[0].carrier}-${shopifyRates[0].service}`);
    }
  }, [fulfillmentOption, shopifyRates]);

  const getShippingCost = () => {
    if (fulfillmentOption === "amazon") {
      return 0; // Prime shipping is free
    }
    const rate = shopifyRates.find(
      (r) => `${r.carrier}-${r.service}` === selectedRate
    );
    return rate ? rate.price : 0;
  };

  const total = subtotal + getShippingCost();

  const handlePlaceOrder = async () => {
    setIsProcessing(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quantity,
          itemPrice,
          fulfillmentOption,
          shippingRate: fulfillmentOption === "shopify" ? selectedRate : null,
          total,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push(
          `/confirmation?orderId=${data.orderId}&fulfillment=${fulfillmentOption}`
        );
      } else {
        alert(`Error: ${data.error}`);
        setIsProcessing(false);
      }
    } catch (error) {
      alert("Failed to place order. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            href="/product"
            className="text-2xl font-bold text-gray-900 hover:text-blue-600"
          >
            ← Back to Product
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid gap-8">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Order Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Sample Product × {quantity}
                </span>
                <span className="font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-semibold">
                  {fulfillmentOption === "amazon"
                    ? "FREE"
                    : `$${getShippingCost().toFixed(2)}`}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg">
                <span className="font-bold text-gray-900">Total</span>
                <span className="font-bold text-blue-600">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Fulfillment Options */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Fulfillment Option
            </h2>

            <div className="space-y-4">
              {/* Shopify Shipping Option */}
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  fulfillmentOption === "shopify"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setFulfillmentOption("shopify")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <input
                      type="radio"
                      checked={fulfillmentOption === "shopify"}
                      onChange={() => setFulfillmentOption("shopify")}
                      className="mt-1"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        🚚 Ship from Store
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Shopify Shipping with discounted carrier rates
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shipping Rates */}
                {fulfillmentOption === "shopify" && (
                  <div className="mt-4 ml-8 space-y-2">
                    {shopifyRates.map((rate) => (
                      <div
                        key={`${rate.carrier}-${rate.service}`}
                        className={`flex items-center justify-between p-3 rounded border ${
                          selectedRate === `${rate.carrier}-${rate.service}`
                            ? "border-blue-600 bg-blue-50"
                            : "border-gray-200"
                        }`}
                      >
                        <label className="flex items-center space-x-3 cursor-pointer flex-1">
                          <input
                            type="radio"
                            name="shipping-rate"
                            value={`${rate.carrier}-${rate.service}`}
                            checked={
                              selectedRate === `${rate.carrier}-${rate.service}`
                            }
                            onChange={(e) => setSelectedRate(e.target.value)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {rate.carrier} - {rate.service}
                            </div>
                            <div className="text-sm text-gray-600">
                              {rate.deliveryDays} business days
                            </div>
                          </div>
                          <div className="font-semibold text-gray-900">
                            ${rate.price.toFixed(2)}
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Amazon FBA Option */}
              <div
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  fulfillmentOption === "amazon"
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setFulfillmentOption("amazon")}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="radio"
                    checked={fulfillmentOption === "amazon"}
                    onChange={() => setFulfillmentOption("amazon")}
                    className="mt-1"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      📦 Fulfilled by Amazon
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Prime delivery - FREE shipping (1-2 days)
                    </p>
                    <div className="mt-2 inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm font-semibold">
                      Prime
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={isProcessing}
            className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-colors ${
              isProcessing
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isProcessing ? "Processing..." : "Place Order"}
          </button>
        </div>
      </main>
    </div>
  );
}
