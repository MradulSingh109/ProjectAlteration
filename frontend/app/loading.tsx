import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { AppContainer } from "@/components/shared/app-container";

export default function Loading() {
  return (
    <main className="flex min-h-[60vh] flex-1 items-center justify-center">
      <AppContainer size="sm" className="text-center">
        <LoadingSpinner
          size="lg"
          label="Loading SIH26034 compliance system..."
        />
      </AppContainer>
    </main>
  );
}
