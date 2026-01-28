import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOrderEmail = async (booking) => {
  try {
    const productsHTML = booking.products
      ?.map(p => `<li>${p.name} - Qty: ${p.quantity} - ₹${p.price}</li>`)
      .join('');

    // Send to admin
    await resend.emails.send({
      from: 'orders@ramisilks.com',
      to: 'manastudioofficial@gmail.com',
      subject: `New Order - ${booking.bookingId}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order ID:</strong> ${booking.bookingId}</p>
        <p><strong>Customer:</strong> ${booking.customer?.name}</p>
        <p><strong>Email:</strong> ${booking.customer?.email}</p>
        <p><strong>Phone:</strong> ${booking.customer?.phone}</p>
        <p><strong>Payment ID:</strong> ${booking.paymentInfo?.razorpayPaymentId}</p>
        <p><strong>Total:</strong> ₹${booking.totalAmount}</p>
        <h3>Products:</h3>
        <ul>${productsHTML}</ul>
        <p><strong>Address:</strong> ${booking.shippingAddress?.fullAddress}</p>
      `
    });

    // Send to customer
    await resend.emails.send({
      from: 'orders@ramisilks.com',
      to: booking.customer?.email,
      subject: `Order Confirmation - ${booking.bookingId}`,
      html: `
        <h2>Thank you for your order!</h2>
        <p>Hi ${booking.customer?.name},</p>
        <p>Your order <strong>${booking.bookingId}</strong> has been confirmed.</p>
        <h3>Order Details:</h3>
        <ul>${productsHTML}</ul>
        <p><strong>Total:</strong> ₹${booking.totalAmount}</p>
        <p>We'll process your order shortly!</p>
      `
    });

    return { success: true };
  } catch (error) {
    console.error('Email failed:', error);
    return { success: false, error: error.message };
  }
};

export default sendOrderEmail;
