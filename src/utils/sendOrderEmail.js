import axios from "axios";
import qs from "qs";

const sendOrderEmail = async (booking) => {
  try {
    // Validate booking data
    if (!booking || !booking.bookingId) {
      console.warn("Invalid booking data - skipping email");
      return { success: false, error: "Invalid booking data" };
    }

    // Validate customer email exists
    if (!booking.customer?.email) {
      console.warn("Customer email missing - sending to admin only");
    }

    const adminEmail = "manastudioofficial@gmail.com";

    // Format products list for email
    const productsText = Array.isArray(booking.products)
      ? booking.products
          .map(
            (p, i) =>
              `${i + 1}. ${p.name || p.product || "Unknown"} | Qty: ${
                p.quantity || 0
              } | Price: ₹${p.price || 0}`
          )
          .join("\n")
      : "No products listed";

    // Prepare payload with all order details
    const payload = {
      // FormSubmit Configuration
      _subject: `New Order Confirmed - ${booking.bookingId}`,
      _template: "table", // Use table format for better readability
      _captcha: "false", // Disable captcha for API submissions
      _cc: booking.customer?.email || "", // Send copy to customer

      // Order Information
      "Booking ID": booking.bookingId,
      "Order Status": booking.bookingStatus || "Confirmed",
      "Order Date": booking.createdAt || new Date().toISOString(),

      // Customer Details
      "Customer Name": booking.customer?.name || "N/A",
      "Customer Email": booking.customer?.email || "N/A",
      "Customer Phone": booking.customer?.phone || "N/A",

      // Payment Information
      "Payment ID": booking.paymentInfo?.razorpayPaymentId || "N/A",
      "Payment Status": booking.paymentInfo?.paymentStatus || "Pending",
      "Paid At": booking.paymentInfo?.paidAt || "N/A",
      "Total Amount": `₹${booking.totalAmount || 0}`,

      // Order Details
      Products: productsText,
      "Shipping Address": booking.shippingAddress?.fullAddress || "N/A",
    };

    // Send email via FormSubmit
    const response = await axios.post(
      `https://formsubmit.co/${adminEmail}`,
      qs.stringify(payload),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 8000, // 8 second timeout
      }
    );

    // Log success
    if (response.status === 200) {
      console.log(
        `✅ Order email sent successfully to admin${
          booking.customer?.email ? " and customer" : ""
        }: ${booking.bookingId}`
      );
      return {
        success: true,
        message: "Email sent successfully",
        recipients: {
          admin: adminEmail,
          customer: booking.customer?.email || null,
        },
      };
    }

    return { success: false, error: "Unexpected response status" };
  } catch (error) {
    // Enhanced error logging with silent fail
    const errorInfo = {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      message: error.message,
      bookingId: booking?.bookingId,
    };

    console.warn("⚠️ FormSubmit order email failed:", errorInfo);

    // Return error details for optional retry logic
    return {
      success: false,
      error: error.message,
      details: errorInfo,
    };
  }
};

export default sendOrderEmail;
