import axios from "axios";

/**
 * Send order / booking details via FormSubmit email
 * @param {Object} booking - Booking document
 */
const sendOrderEmail = async (booking) => {
  try {
    const formUrl = "https://formsubmit.co/manastudioofficial@gmail.com";

    const productsText = booking.products
      .map(
        (p, i) =>
          `${i + 1}. ${p.name || p.product} | Qty: ${p.quantity} | Price: ₹${p.price}`
      )
      .join("\n");

    const payload = {
      _subject: `New Order Confirmed - ${booking.bookingId}`,
      _template: "table",
      _captcha: "false",

      bookingId: booking.bookingId,
      customerName: booking.customer?.name,
      customerEmail: booking.customer?.email,
      customerPhone: booking.customer?.phone,

      paymentId: booking.paymentInfo?.razorpayPaymentId,
      paymentStatus: booking.paymentInfo?.paymentStatus,
      paidAt: booking.paymentInfo?.paidAt,

      totalAmount: booking.totalAmount,
      bookingStatus: booking.bookingStatus,

      products: productsText,
      address: booking.shippingAddress?.fullAddress,
      createdAt: booking.createdAt,
    };

    await axios.post(formUrl, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // ❗ Do NOT throw — email failure should not break payment flow
    console.error("FormSubmit order email failed:", error.message);
  }
};

export default sendOrderEmail;

// https://formsubmit.co/