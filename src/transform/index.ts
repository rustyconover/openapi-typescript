import { OperationObject, PathItemObject, SchemaFormatter } from "../types";
import { comment, tsReadonly } from "../utils";
import { transformHeaderObjMap } from "./headers";
import { transformOperationObj } from "./operation";
import { transformPathsObj } from "./paths";
import { transformResponsesObj, transformRequestBodies } from "./responses";
import { transformSchemaObjMap } from "./schema";

interface TransformOptions {
  formatter?: SchemaFormatter;
  immutableTypes: boolean;
  rawSchema?: boolean;
  version: number;
}

export async function transformAll(
  schema: any,
  { formatter, immutableTypes, rawSchema, version }: TransformOptions
): Promise<Record<string, string>> {
  const readonly = tsReadonly(immutableTypes);

  let output: Record<string, string> = {} as any;

  let operations: Record<string, { operation: OperationObject; pathItem: PathItemObject }> = {};

  // --raw-schema mode
  if (rawSchema) {
    switch (version) {
      case 2: {
        output.definitions = transformSchemaObjMap(schema, {
          formatter,
          immutableTypes,
          required: Object.keys(schema),
        });
        return output;
      }
      case 3: {
        output.schemas = transformSchemaObjMap(schema, {
          formatter,
          immutableTypes,
          required: Object.keys(schema),
        });
        return output;
      }
    }
  }

  // #/paths (V2 & V3)
  output.paths = "";
  if (schema.paths) {
    output.paths += transformPathsObj(schema.paths, {
      globalParameters: (schema.components && schema.components.parameters) || schema.parameters,
      immutableTypes,
      operations,
      version,
    });
  }

  switch (version) {
    case 2: {
      // #/definitions
      if (schema.definitions) {
        output.definitions = transformSchemaObjMap(schema.definitions, {
          formatter,
          immutableTypes,
          required: Object.keys(schema.definitions),
        });
      }

      // #/parameters
      if (schema.parameters) {
        const required = Object.keys(schema.parameters);
        output.parameters = transformSchemaObjMap(schema.parameters, {
          formatter,
          immutableTypes,
          required,
        });
      }

      // #/parameters
      if (schema.responses) {
        output.responses = transformResponsesObj(schema.responses, {
          formatter,
          immutableTypes,
        });
      }
      break;
    }
    case 3: {
      // #/components
      output.components = "";

      if (schema.components) {
        // #/components/schemas
        if (schema.components.schemas) {
          const required = Object.keys(schema.components.schemas);
          output.components += `  ${readonly}schemas: {\n    ${transformSchemaObjMap(schema.components.schemas, {
            formatter,
            immutableTypes,
            required,
          })}\n  }\n`;
        }

        // #/components/responses
        if (schema.components.responses) {
          output.components += `  ${readonly}responses: {\n    ${transformResponsesObj(schema.components.responses, {
            formatter,
            immutableTypes,
          })}\n  }\n`;
        }

        // #/components/parameters
        if (schema.components.parameters) {
          const required = Object.keys(schema.components.parameters);
          output.components += `  ${readonly}parameters: {\n    ${transformSchemaObjMap(schema.components.parameters, {
            formatter,
            immutableTypes,
            required,
          })}\n  }\n`;
        }

        // #/components/requestBodies
        if (schema.components.requestBodies) {
          output.components += `  ${readonly}requestBodies: {\n    ${transformRequestBodies(
            schema.components.requestBodies,
            {
              formatter,
              immutableTypes,
            }
          )}\n  }\n`;
        }

        // #/components/headers
        if (schema.components.headers) {
          output.components += `  ${readonly}headers: {\n    ${transformHeaderObjMap(schema.components.headers, {
            formatter,
            immutableTypes,
          })}  }\n`;
        }
      }

      break;
    }
  }

  // #/operations
  output.operations = "";
  if (Object.keys(operations).length) {
    Object.entries(operations).forEach(([operationId, { operation, pathItem }]) => {
      if (operation.description) output.operations += comment(operation.description); // handle comment
      output.operations += `  ${readonly}"${operationId}": {\n    ${transformOperationObj(operation, {
        pathItem,
        globalParameters: (schema.components && schema.components.parameters) || schema.parameters,
        immutableTypes,
        version,
      })}\n  }\n`;
    });
  }

  // cleanup: trim whitespace
  for (const [k, v] of Object.entries(output)) {
    if (typeof v === "string") {
      output[k] = v.trim();
    }
  }

  return output;
}
