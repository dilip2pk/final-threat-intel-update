import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ThreatHunt {
  id: string;
  name: string;
  description: string;
  query: Record<string, any>;
  hunt_type: string;
  status: string;
  severity: string;
  findings_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ThreatHuntResult {
  id: string;
  hunt_id: string;
  source_type: string;
  source_id: string | null;
  match_data: Record<string, any>;
  severity: string;
  title: string;
  description: string;
  is_false_positive: boolean;
  created_at: string;
}

export interface ThreatHuntPlaybook {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: any[];
  severity: string;
  tags: string[];
  is_builtin: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useThreatHunts() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const huntsQuery = useQuery({
    queryKey: ["threat-hunts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_hunts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ThreatHunt[];
    },
  });

  const playbooksQuery = useQuery({
    queryKey: ["threat-hunt-playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("threat_hunt_playbooks" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as ThreatHuntPlaybook[];
    },
  });

  const createHunt = useMutation({
    mutationFn: async (hunt: Partial<ThreatHunt>) => {
      const { data, error } = await supabase
        .from("threat_hunts" as any)
        .insert(hunt as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ThreatHunt;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threat-hunts"] });
      toast({ title: "Hunt created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateHunt = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ThreatHunt> & { id: string }) => {
      const { error } = await supabase
        .from("threat_hunts" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threat-hunts"] });
    },
  });

  const deleteHunt = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("threat_hunts" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threat-hunts"] });
      toast({ title: "Hunt deleted" });
    },
  });

  const getResults = async (huntId: string): Promise<ThreatHuntResult[]> => {
    const { data, error } = await supabase
      .from("threat_hunt_results" as any)
      .select("*")
      .eq("hunt_id", huntId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as ThreatHuntResult[];
  };

  return {
    hunts: huntsQuery.data || [],
    playbooks: playbooksQuery.data || [],
    isLoading: huntsQuery.isLoading,
    isPlaybooksLoading: playbooksQuery.isLoading,
    createHunt,
    updateHunt,
    deleteHunt,
    getResults,
  };
}
