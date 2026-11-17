import AppShell from './shell/AppShell'
import DeliveryAreaPage from './delivery-area/DeliveryAreaPage'

export default function App() {
  // Routing is a follow-up story: the restaurant comes from the query string.
  const restaurantId = new URLSearchParams(window.location.search).get('restaurant')
  return (
    <AppShell current="operations">
      {restaurantId ? (
        <DeliveryAreaPage restaurantId={restaurantId} />
      ) : (
        <div className="empty-state">
          <h1>Delivery area</h1>
          <p>Open this page with a restaurant, for example ?restaurant=&lt;restaurant id&gt;.</p>
        </div>
      )}
    </AppShell>
  )
}
