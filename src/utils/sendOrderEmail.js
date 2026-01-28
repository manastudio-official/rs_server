import axios from "axios";
import qs from "qs";

/**
 * Send order/booking details to both admin and customer via FormSubmit
 * Sends URL-encoded form data matching FormSubmit's expected format
 * @param {Object} booking - Complete booking object
 * @returns {Promise<Object>} Success status
 */
const sendOrderEmail = async (booking) => {
  try {
    // Validate booking data
    if (!booking || !booking.bookingId) {
      console.warn("Invalid booking data - skipping email");
      return { success: false, error: "Invalid booking data" };
    }

    const adminEmail = "manastudioofficial@gmail.com";

    // Format products list for email
    const productsText = Array.isArray(booking.products)
      ? booking.products
          .map(
            (p, i) =>
              `${i + 1}. ${p.name || p.product || "Unknown"} - Qty: ${
                p.quantity || 0
              } - Price: ₹${p.price || 0}`
          )
          .join("\n")
      : "No products listed";

    // Prepare form data payload (matching your FormSubmit format)
    const formData = {
      _subject: `New Order Confirmed - ${booking.bookingId}`,
      _captcha: "false",
      _template: "table",
      _cc: booking.customer?.email || "", // CC customer email
      
      // Order details
      "Booking ID": booking.bookingId,
      "Order Status": booking.bookingStatus || "Confirmed",
      "Order Date": booking.createdAt || new Date().toISOString(),
      
      // Customer info
      name: booking.customer?.name || "N/A",
      email: booking.customer?.email || "N/A",
      phone: booking.customer?.phone || "N/A",
      
      // Payment details
      "Payment ID": booking.paymentInfo?.razorpayPaymentId || "N/A",
      "Payment Status": booking.paymentInfo?.paymentStatus || "Pending",
      "Paid At": booking.paymentInfo?.paidAt || "N/A",
      "Total Amount": `₹${booking.totalAmount || 0}`,
      
      // Order items and shipping
      products: productsText,
      "Shipping Address": booking.shippingAddress?.fullAddress || "N/A",
    };

    // Send POST request with URL-encoded form data
    const response = await axios.post(
      `https://formsubmit.co/${adminEmail}`,
      qs.stringify(formData),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 8000,
      }
    );

    // Success logging
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
    const errorInfo = {
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      message: error.message,
      bookingId: booking?.bookingId,
    };

    console.warn("⚠️ FormSubmit order email failed:", errorInfo);

    return {
      success: false,
      error: error.message,
      details: errorInfo,
    };
  }
};

export default sendOrderEmail;
