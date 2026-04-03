import { BrokerTransitionConflictError } from "./broker-client";
import { buildComposeRequest } from "./mapping";
import type {
  BrokerClientLike,
  ExecutableGmailProposal,
  ExecutorFailureDetails,
  ExecutorLogger,
  ExecutorRunSummary,
  GmailAutomationBackend
} from "./types";

export interface GmailExecutorOptions {
  brokerClient: BrokerClientLike;
  backend: GmailAutomationBackend;
  logger: ExecutorLogger;
}

export class GmailWebExecutor {
  private readonly brokerClient: BrokerClientLike;

  private readonly backend: GmailAutomationBackend;

  private readonly logger: ExecutorLogger;

  public constructor(options: GmailExecutorOptions) {
    this.brokerClient = options.brokerClient;
    this.backend = options.backend;
    this.logger = options.logger;
  }

  public async runOnce(): Promise<ExecutorRunSummary> {
    const proposals = await this.brokerClient.fetchApprovedExecutableProposals();
    const summary: ExecutorRunSummary = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0
    };

    for (const proposal of proposals) {
      const result = await this.processProposal(proposal);
      summary.processed += 1;
      summary[result] += 1;
    }

    this.logger.info("Executor run complete.", { ...summary });
    return summary;
  }

  public async poll(pollIntervalMs: number, shouldContinue?: () => boolean): Promise<void> {
    while (shouldContinue ? shouldContinue() : true) {
      await this.runOnce();
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  private async processProposal(
    proposal: ExecutableGmailProposal
  ): Promise<"succeeded" | "failed" | "skipped"> {
    this.logger.info("Processing approved proposal.", {
      proposalId: proposal.id,
      kind: proposal.kind
    });

    try {
      await this.brokerClient.markExecuting(proposal.id);
    } catch (error) {
      if (error instanceof BrokerTransitionConflictError) {
        this.logger.warn("Proposal was claimed or changed before execution.", {
          proposalId: proposal.id
        });
        return "skipped";
      }

      throw error;
    }

    try {
      const composeRequest = buildComposeRequest(proposal);
      const executionResult = await this.backend.execute(composeRequest);
      await this.brokerClient.markExecuted(proposal.id, executionResult);
      this.logger.info("Proposal executed successfully.", {
        proposalId: proposal.id,
        kind: proposal.kind,
        verification: executionResult.verification
      });
      return "succeeded";
    } catch (error) {
      const failure = this.toFailureDetails(error);

      try {
        await this.brokerClient.markFailed(proposal.id, failure);
      } catch (markFailedError) {
        this.logger.error("Failed to report executor failure back to broker.", {
          proposalId: proposal.id,
          originalError: failure.errorMessage,
          markFailedError:
            markFailedError instanceof Error
              ? markFailedError.message
              : String(markFailedError)
        });
        throw markFailedError;
      }

      this.logger.error("Proposal execution failed.", {
        proposalId: proposal.id,
        errorMessage: failure.errorMessage
      });
      return "failed";
    }
  }

  private toFailureDetails(error: unknown): ExecutorFailureDetails {
    if (error instanceof Error) {
      return {
        errorCode: error.name,
        errorMessage: error.message
      };
    }

    return {
      errorCode: "UNKNOWN_ERROR",
      errorMessage: String(error)
    };
  }
}
