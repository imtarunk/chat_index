import { useState } from "react";

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "../lib/supabase";

// Define the structure of a single search result
interface SearchResult {
  id: number;
  message: string;
  similarity: number;
}

export function HybridSearch() {
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "hybrid-search",
        {
          body: { query },
        }
      );

      if (invokeError) {
        throw new Error(`Function invocation failed: ${invokeError.message}`);
      }

      if (!Array.isArray(data)) {
        throw new Error("The search result format is unexpected.");
      }

      setResults(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("Search failed:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Chat History Search</CardTitle>
          <CardDescription>
            Enter a query to search through the indexed chat sessions using
            hybrid search.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="e.g., challenges in the teaching profession"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={isLoading}
            />
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {isLoading && <p className="text-center">Loading search results...</p>}

        {!isLoading && results.length === 0 && !error && (
          <p className="text-center text-gray-500">
            No results to display. Try a new search.
          </p>
        )}

        {results.map((result) => (
          <Card key={result.id}>
            <CardHeader>
              <CardDescription>
                Similarity Score: {result.similarity.toFixed(4)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{result.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
