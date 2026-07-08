import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, IntColumn as IntColumn_, Index as Index_, OneToMany as OneToMany_, Relation as Relation_} from "@subsquid/typeorm-store"
import {PieceToken} from "./pieceToken.model"
import {PieceTransfer} from "./pieceTransfer.model"

@Entity_()
export class PieceCollection {
    constructor(props?: Partial<PieceCollection>) {
        Object.assign(this, props)
    }

    /**
     * contract address (lowercase)
     */
    @PrimaryColumn_()
    id!: string

    /**
     * on-chain name() — the edition label, verbatim
     */
    @StringColumn_({nullable: false})
    edition!: string

    /**
     * on-chain symbol()
     */
    @StringColumn_({nullable: false})
    symbol!: string

    @Index_("idx_piece_collection_first_seen_block_be93318a")
    @IntColumn_({nullable: false})
    firstSeenBlock!: number

    /**
     * count of live (non-burned) tokens, maintained incrementally
     */
    @IntColumn_({nullable: false})
    totalSupply!: number

    @OneToMany_(() => PieceToken, e => e.collection)
    tokens!: Relation_<PieceToken[]>

    @OneToMany_(() => PieceTransfer, e => e.collection)
    transfers!: Relation_<PieceTransfer[]>
}
