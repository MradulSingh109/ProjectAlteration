import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/ui/Layout'
import WellMap from '../pages/WellMap'
import WellDetails from '../pages/WellDetails'
import EventExplorer from '../pages/EventExplorer'
import Documents from '../pages/Documents'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <WellMap />
      },
      {
        path: 'wells',
        element: <WellDetails />
      },
      {
        path: 'events',
        element: <EventExplorer />
      },
      {
        path: 'documents',
        element: <Documents />
      }
    ]
  }
])
