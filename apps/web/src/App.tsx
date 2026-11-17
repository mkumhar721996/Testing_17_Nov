import ManageMenuPage from './menu/ManageMenuPage'
import AppShell from './shell/AppShell'

// The restaurant is chosen at deploy time until a sign-in story provides the manager's restaurants.
const restaurantId = import.meta.env.VITE_RESTAURANT_ID ?? ''

export default function App() {
  return (
    <AppShell current="operations">
      <ManageMenuPage restaurantId={restaurantId} />
    </AppShell>
  )
}
