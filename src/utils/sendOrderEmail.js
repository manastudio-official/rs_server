import axios from "axios";
import qs from "qs";

/**
 * Send order / booking details via FormSubmit email
 * FAIL-SAFE & 403-safe
 */
const sendOrderEmail = async (booking) => {
  try {
    if (!booking) return;

    const formUrl = "https://formsubmit.co/manastudioofficial@gmail.com";

    const productsText = Array.isArray(booking.products)
      ? booking.products
          .map(
            (p, i) =>
              `${i + 1}. ${p.name || p.product} | Qty: ${p.quantity} | Price: ₹${p.price}`
          )
          .join("\n")
      : "N/A";

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

    await axios.post(formUrl, qs.stringify(payload), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 5000,
    });
  } catch (error) {
    // SILENT FAIL — expected sometimes
    console.warn(
      "FormSubmit order email skipped:",
      error?.response?.status || error.message
    );
  }
};

export default sendOrderEmail;
