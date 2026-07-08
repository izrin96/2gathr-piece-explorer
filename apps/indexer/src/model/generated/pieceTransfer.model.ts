import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_, StringColumn as StringColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {PieceCollection} from "./pieceCollection.model"

@Entity_()
export class PieceTransfer {
    constructor(props?: Partial<PieceTransfer>) {
        Object.assign(this, props)
    }

    /**
     * `${blockNumber}-${logIndex}`
     */
    @PrimaryColumn_()
    id!: string

    @Index_("idx_piece_transfer_collection_58e26a18")
    @ManyToOne_(() => PieceCollection, {nullable: true})
    collection!: Relation_<PieceCollection>

    @Index_("idx_piece_transfer_contract_address_0dcd2e55")
    @StringColumn_({nullable: false})
    contractAddress!: string

    @Index_("idx_piece_transfer_token_id_679f8bc4")
    @StringColumn_({nullable: false})
    tokenId!: string

    @Index_("idx_piece_transfer_from_176b982e")
    @StringColumn_({nullable: false})
    from!: string

    @Index_("idx_piece_transfer_to_dcf3def6")
    @StringColumn_({nullable: false})
    to!: string

    @Index_("idx_piece_transfer_timestamp_8975d08e")
    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @Index_("idx_piece_transfer_block_number_76e63e97")
    @IntColumn_({nullable: false})
    blockNumber!: number

    @IntColumn_({nullable: false})
    logIndex!: number

    @Index_("idx_piece_transfer_hash_9ddcfa89")
    @StringColumn_({nullable: false})
    hash!: string
}
