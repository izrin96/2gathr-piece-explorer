import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, Relation as Relation_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {PieceCollection} from "./pieceCollection.model"

@Entity_()
export class PieceToken {
    constructor(props?: Partial<PieceToken>) {
        Object.assign(this, props)
    }

    /**
     * `${contractAddress}-${tokenId}`
     */
    @PrimaryColumn_()
    id!: string

    @Index_("idx_piece_token_collection_4db847cc")
    @ManyToOne_(() => PieceCollection, {nullable: true})
    collection!: Relation_<PieceCollection>

    @Index_("idx_piece_token_contract_address_336969f5")
    @StringColumn_({nullable: false})
    contractAddress!: string

    /**
     * decimal string token id
     */
    @StringColumn_({nullable: false})
    tokenId!: string

    /**
     * on-chain serial number (= tokenId as an integer)
     */
    @Index_("idx_piece_token_serial_c87b1c3e")
    @BigIntColumn_({nullable: false})
    serial!: bigint

    @Index_("idx_piece_token_owner_253d152c")
    @StringColumn_({nullable: false})
    owner!: string

    @DateTimeColumn_({nullable: false})
    mintedAt!: Date

    @Index_("idx_piece_token_last_transfer_at_2eb0caf6")
    @DateTimeColumn_({nullable: false})
    lastTransferAt!: Date

    @IntColumn_({nullable: false})
    lastTransferBlock!: number
}
