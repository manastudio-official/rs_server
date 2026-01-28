import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendOrderEmail = async (booking) => {
  try {
    const productsHTML = booking.products
      ?.map(p => `<li>${p.name} - Qty: ${p.quantity} - ₹${p.price}</li>`)
      .join('');

    // Build full address string
    const fullAddress = `${booking.address.street}, ${booking.address.city}, ${booking.address.state} - ${booking.address.pincode}, ${booking.address.country}`;

    // Customer full name
    const customerName = `${booking.firstName} ${booking.lastName}`;

    // Send to admin
    await resend.emails.send({
      from: 'orders@ramisilks.com',
      to: 'manastudioofficial@gmail.com',
      subject: `New Order - ${booking.bookingId}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order ID:</strong> ${booking.bookingId}</p>
        <p><strong>Customer:</strong> ${customerName}</p>
        <p><strong>Email:</strong> ${booking.email}</p>
        <p><strong>Phone:</strong> ${booking.phoneNumber}</p>
        <p><strong>Payment ID:</strong> ${booking.paymentInfo?.razorpayPaymentId}</p>
        <p><strong>Total:</strong> ₹${booking.orderTotal.total}</p>
        <h3>Products:</h3>
        <ul>${productsHTML}</ul>
        <p><strong>Address:</strong> ${fullAddress}</p>
      `
    });

    // Send to customer
    await resend.emails.send({
      from: 'orders@ramisilks.com',
      to: booking.email,
      subject: `Order Confirmation - ${booking.bookingId}`,
      html: `
        <h2>Thank you for your order!</h2>
        <p>Hi ${customerName},</p>
        <p>Your order <strong>${booking.bookingId}</strong> has been confirmed.</p>
        <h3>Order Details:</h3>
        <ul>${productsHTML}</ul>
        <p><strong>Total:</strong> ₹${booking.orderTotal.total}</p>
        <p><strong>Expected Delivery:</strong> ${new Date(booking.expectedDeliveryDate).toLocaleDateString('en-IN')}</p>
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
