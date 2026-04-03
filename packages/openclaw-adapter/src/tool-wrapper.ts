import { OpenClawEmailActionInputSchema } from "./schemas";
import type {
  CreateBrokerProposalResult,
  OpenClawEmailActionInput,
  ProposeEmailToolOptions
} from "./types";
import type { OpenClawAdapterClient } from "./client";

export interface ProposeEmailTool {
  name: string;
  description: string;
  invoke(input: unknown): Promise<CreateBrokerProposalResult>;
}

export function createProposeEmailTool(
  client: OpenClawAdapterClient,
  options: ProposeEmailToolOptions = {}
): ProposeEmailTool {
  return {
    name: options.name ?? "propose_email_action",
    description:
      options.description ??
      "Create an approval-gated email proposal in the broker. This tool only proposes actions and never sends email directly.",
    async invoke(input: unknown): Promise<CreateBrokerProposalResult> {
      const parsed = OpenClawEmailActionInputSchema.parse(
        input
      ) as OpenClawEmailActionInput;

      return client.createEmailProposal(parsed, {
        requester: options.requester,
        expiresAt: options.expiresAt
      });
    }
  };
}
