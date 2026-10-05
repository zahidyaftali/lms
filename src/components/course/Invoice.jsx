import { Badge, Button, Modal } from '../ui'
import { useData } from '../../context/DataContext'
import { formatDate, fullName } from '../../lib/utils'

export const ORDER_STATUS = {
  paid: ['Paid', 'green'],
  pending: ['Awaiting payment', 'amber'],
  cancelled: ['Cancelled', 'gray'],
}

export const PAYMENT_METHOD = {
  stripe: 'Card (Stripe)',
  paypal: 'PayPal',
  offline: 'Paid to the office',
  credits: 'Credits',
  free: 'Free',
  trial: 'Free trial',
  subscription: 'Subscription',
  external: 'Online store',
}

/** An order's amount in the currency it was placed in, which may differ from today's portal currency. */
export function orderAmount(order) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: order.currency || 'USD' }).format(Number(order.amount) || 0)
  } catch {
    return `${Number(order.amount || 0).toFixed(2)} ${order.currency || ''}`
  }
}

export function OrderStatus({ order }) {
  const [label, tone] = ORDER_STATUS[order.status] || [order.status, 'gray']
  return <Badge tone={tone}>{label}</Badge>
}

/** A printable invoice for a paid order. */
export default function InvoiceDialog({ order, buyer, onClose }) {
  const { settings } = useData()
  if (!order) return null
  const invoices = settings.ecommerce?.invoices || {}
  const money = (n) => orderAmount({ ...order, amount: n })
  return (
    <Modal
      open
      onClose={onClose}
      title={order.invoiceNo ? `Invoice ${order.invoiceNo}` : 'Receipt'}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button icon="download" onClick={() => window.print()}>
            Print
          </Button>
        </>
      }
    >
      <div className="print-sheet bg-white p-2 sm:p-4 text-[14px] text-ink-900">
        <div className="flex flex-wrap justify-between gap-6 mb-8">
          <div>
            <p className="text-[18px] font-bold">{settings.siteName}</p>
            <p className="hint whitespace-pre-line mt-1">{invoices.details || [settings.address, settings.supportEmail, settings.supportPhone].filter(Boolean).join('\n')}</p>
          </div>
          <div className="text-right">
            <p className="text-[20px] font-bold tracking-wide">{order.invoiceNo ? 'INVOICE' : 'RECEIPT'}</p>
            {order.invoiceNo && <p className="mt-1">{order.invoiceNo}</p>}
            <p className="hint">{formatDate(order.paidAt || order.at)}</p>
          </div>
        </div>

        <p className="hint mb-1">Billed to</p>
        <p className="font-medium">{buyer ? fullName(buyer) : 'Former learner'}</p>
        {buyer?.email && <p className="hint mb-6">{buyer.email}</p>}

        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="border-y border-line text-left">
              <th className="py-2.5 font-semibold">Description</th>
              <th className="py-2.5 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line">
              <td className="py-2.5">{order.name}</td>
              <td className="py-2.5 text-right">{money(order.list ?? order.amount)}</td>
            </tr>
            {(order.lines || []).map((line) => (
              <tr key={line.label} className="border-b border-line text-ink-700">
                <td className="py-2.5">{line.label}</td>
                <td className="py-2.5 text-right">{line.amount ? `− ${money(-line.amount)}` : ''}</td>
              </tr>
            ))}
            <tr>
              <td className="py-3 font-bold">Total paid</td>
              <td className="py-3 text-right font-bold">{money(order.amount)}</td>
            </tr>
          </tbody>
        </table>

        <p className="hint">
          Paid by {(PAYMENT_METHOD[order.method] || order.method || '').toLowerCase()}
          {order.ref ? ` · reference ${order.ref}` : ''}
        </p>
        {invoices.note && <p className="mt-6 pt-4 border-t border-line hint whitespace-pre-line">{invoices.note}</p>}
      </div>
    </Modal>
  )
}
