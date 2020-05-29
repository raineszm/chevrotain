import { assign, forEach, isRegExp, map, pick } from "../../../utils/utils"
import { tokenLabel } from "../../../scan/tokens_public"
import {
  IGASTVisitor,
  IProduction,
  IProductionWithOccurrence,
  ISerializedGast,
  TokenType
} from "../../../../api"

export abstract class AbstractProduction implements IProduction {
  constructor(public definition: IProduction[]) {}

  accept(visitor: IGASTVisitor): void {
    visitor.visit(this)
    forEach(this.definition, (prod) => {
      prod.accept(visitor)
    })
  }
}

export class NonTerminal extends AbstractProduction
  implements IProductionWithOccurrence {
  public nonTerminalName: string
  public referencedRule: Rule
  public idx: number = 1

  constructor(options: {
    nonTerminalName: string
    referencedRule?: Rule
    idx?: number
  }) {
    super([])
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }

  set definition(definition: IProduction[]) {
    // immutable
  }

  get definition(): IProduction[] {
    if (this.referencedRule !== undefined) {
      return this.referencedRule.definition
    }
    return []
  }

  accept(visitor: IGASTVisitor): void {
    visitor.visit(this)
    // don't visit children of a reference, we will get cyclic infinite loops if we do so
  }
}

export class Rule extends AbstractProduction {
  public name: string
  public orgText: string = ""

  constructor(options: {
    name: string
    definition: IProduction[]
    orgText?: string
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class Alternative extends AbstractProduction {
  public ignoreAmbiguities: boolean = false

  constructor(options: {
    definition: IProduction[]
    ignoreAmbiguities?: boolean
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class Option extends AbstractProduction
  implements IProductionWithOccurrence {
  public idx: number = 1
  public maxLookahead?: number

  constructor(options: {
    definition: IProduction[]
    idx?: number
    maxLookahead?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class RepetitionMandatory extends AbstractProduction
  implements IProductionWithOccurrence {
  public idx: number = 1
  public maxLookahead?: number

  constructor(options: {
    definition: IProduction[]
    idx?: number
    maxLookahead?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class RepetitionMandatoryWithSeparator extends AbstractProduction
  implements IProductionWithOccurrence {
  public separator: TokenType
  public idx: number = 1

  constructor(options: {
    definition: IProduction[]
    separator: TokenType
    idx?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class Repetition extends AbstractProduction
  implements IProductionWithOccurrence {
  public separator: TokenType
  public idx: number = 1
  public maxLookahead?: number

  constructor(options: {
    definition: IProduction[]
    idx?: number
    maxLookahead?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class RepetitionWithSeparator extends AbstractProduction
  implements IProductionWithOccurrence {
  public separator: TokenType
  public idx: number = 1

  constructor(options: {
    definition: IProduction[]
    separator: TokenType
    idx?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class Alternation extends AbstractProduction
  implements IProductionWithOccurrence {
  public idx: number = 1
  public ignoreAmbiguities: boolean = false
  public definition: Alternative[]
  public hasPredicates: boolean = false
  public maxLookahead?: number

  constructor(options: {
    definition: Alternative[]
    idx?: number
    ignoreAmbiguities?: boolean
    hasPredicates?: boolean
    maxLookahead?: number
  }) {
    super(options.definition)
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }
}

export class Terminal implements IProductionWithOccurrence {
  public terminalType: TokenType
  public idx: number = 1

  constructor(options: { terminalType: TokenType; idx?: number }) {
    assign(
      this,
      pick(options, (v) => v !== undefined)
    )
  }

  accept(visitor: IGASTVisitor): void {
    visitor.visit(this)
  }
}

export interface ISerializedBasic extends ISerializedGast {
  type:
    | "Alternative"
    | "Option"
    | "RepetitionMandatory"
    | "Repetition"
    | "Alternation"
  idx?: number
}

export interface ISerializedGastRule extends ISerializedGast {
  type: "Rule"
  name: string
  orgText: string
}

export interface ISerializedNonTerminal extends ISerializedGast {
  type: "NonTerminal"
  name: string
  idx: number
}

export interface ISerializedTerminal extends ISerializedGast {
  type: "Terminal"
  name: string
  label?: string
  pattern?: string
  idx: number
}

export interface ISerializedTerminalWithSeparator extends ISerializedGast {
  type: "RepetitionMandatoryWithSeparator" | "RepetitionWithSeparator"
  idx: number
  separator: ISerializedTerminal
}

export type ISerializedGastAny =
  | ISerializedBasic
  | ISerializedGastRule
  | ISerializedNonTerminal
  | ISerializedTerminal
  | ISerializedTerminalWithSeparator

export function serializeGrammar(topRules: Rule[]): ISerializedGast[] {
  return map(topRules, serializeProduction)
}

export function serializeProduction(node: IProduction): ISerializedGast {
  function convertDefinition(definition: IProduction[]): ISerializedGast[] {
    return map(definition, serializeProduction)
  }
  /* istanbul ignore else */
  if (node instanceof NonTerminal) {
    return <ISerializedNonTerminal>{
      type: "NonTerminal",
      name: node.nonTerminalName,
      idx: node.idx
    }
  } else if (node instanceof Alternative) {
    return <ISerializedBasic>{
      type: "Alternative",
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof Option) {
    return <ISerializedBasic>{
      type: "Option",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof RepetitionMandatory) {
    return <ISerializedBasic>{
      type: "RepetitionMandatory",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof RepetitionMandatoryWithSeparator) {
    return <ISerializedTerminalWithSeparator>{
      type: "RepetitionMandatoryWithSeparator",
      idx: node.idx,
      separator: <ISerializedTerminal>(
        serializeProduction(new Terminal({ terminalType: node.separator }))
      ),
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof RepetitionWithSeparator) {
    return <ISerializedTerminalWithSeparator>{
      type: "RepetitionWithSeparator",
      idx: node.idx,
      separator: <ISerializedTerminal>(
        serializeProduction(new Terminal({ terminalType: node.separator }))
      ),
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof Repetition) {
    return <ISerializedBasic>{
      type: "Repetition",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof Alternation) {
    return <ISerializedBasic>{
      type: "Alternation",
      idx: node.idx,
      definition: convertDefinition(node.definition)
    }
  } else if (node instanceof Terminal) {
    let serializedTerminal = <ISerializedTerminal>{
      type: "Terminal",
      name: node.terminalType.name,
      label: tokenLabel(node.terminalType),
      idx: node.idx
    }

    let pattern = node.terminalType.PATTERN
    if (node.terminalType.PATTERN) {
      serializedTerminal.pattern = isRegExp(pattern)
        ? (<any>pattern).source
        : pattern
    }

    return serializedTerminal
  } else if (node instanceof Rule) {
    return <ISerializedGastRule>{
      type: "Rule",
      name: node.name,
      orgText: node.orgText,
      definition: convertDefinition(node.definition)
    }
  } else {
    throw Error("non exhaustive match")
  }
}