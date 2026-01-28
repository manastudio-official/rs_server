/**
 * Send order/booking details to both admin and customer via FormSubmit AJAX endpoint
 * Uses JSON format for cleaner data structure
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

    // Prepare JSON payload for AJAX endpoint
    const payload = {
      // FormSubmit configuration
      _subject: `New Order Confirmed - ${booking.bookingId}`,
      _captcha: "false",
      _template: "table",
      _cc: booking.customer?.email || "", // CC customer email

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

    // Send to FormSubmit AJAX endpoint
    const response = await fetch(
      `https://formsubmit.co/ajax/${adminEmail}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    // Check response
    if (response.ok && data.success) {
      console.log(
        `✅ Order email sent successfully to admin${
          booking.customer?.email ? " and customer" : ""
        }: ${booking.bookingId}`
      );

      return {
        success: true,
        message: data.message || "Email sent successfully",
        recipients: {
          admin: adminEmail,
          customer: booking.customer?.email || null,
        },
      };
    }

    return {
      success: false,
      error: data.message || "Failed to send email",
    };

  } catch (error) {
    const errorInfo = {
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
