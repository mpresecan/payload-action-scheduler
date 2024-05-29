import { useSearchParams } from '@payloadcms/ui/providers/SearchParams'
import { useRouter } from 'next/navigation'
import qs from 'qs'


export const useRefresh = () => {
  const { searchParams } = useSearchParams()
  const router = useRouter()
  const refresh = () => {
    searchParams['refresh_token'] = Math.random().toString()
    router.replace(`${qs.stringify(searchParams, { addQueryPrefix: true })}`)
  };
  return { refresh };
}
