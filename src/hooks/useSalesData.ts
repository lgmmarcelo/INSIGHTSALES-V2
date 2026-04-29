import useSWR from 'swr';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Sale } from '../types';

const fetcher = async ([key, startDate, endDate]: [string, string, string]) => {
  const constraints: any[] = [];
  if (startDate) constraints.push(where("dataAtendimentoIso", ">=", startDate));
  if (endDate) constraints.push(where("dataAtendimentoIso", "<=", endDate));
  
  const q = query(collection(db, 'sales'), ...constraints);
  const querySnapshot = await getDocs(q);
  const data: Sale[] = [];
  querySnapshot.forEach((doc) => {
    data.push({ id: doc.id, ...doc.data() } as Sale);
  });
  return data;
};

export function useSalesData(startDate: string, endDate: string) {
  // We only fetch if both are provided or if we specifically decide to fetch all (which is risky)
  // Our system requires either a date range or limits. Here we require date range to be safe.
  const shouldFetch = startDate && endDate;
  
  const { data, error, isLoading, mutate } = useSWR(
    shouldFetch ? ['sales-query', startDate, endDate] : null,
    fetcher,
    {
      revalidateOnFocus: false, // Prevents refetching just because user switched tabs back and forth
      dedupingInterval: 60000 * 5, // Deduplicate perfectly identical requests within 5 minutes
      keepPreviousData: true // Keep showing old data while new data is loading when dates change
    }
  );

  return {
    rawSales: data || [],
    loading: isLoading,
    error,
    mutate
  };
}
